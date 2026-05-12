import datetime as dt
import json
import re

from bson import ObjectId
from flask import Blueprint, request, jsonify
from google import genai
from google.genai import types

from config import db, GEMINI_API, GEMINI_MODEL
from utils.helpers import make_response
from utils.tokenAuth import auth_required

ai_bp = Blueprint("ai", __name__)

# ── Collections ────────────────────────────────────────────────────────────────
_villages = db.villages
_families = db.testing      # actual families collection is named 'testing'
_plots    = db.plots
_houses   = db.house
_chat_sessions = db.chat_sessions

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

# ── Chat session persistence helpers ─────────────────────────────────────────────

def _normalize_chat_messages(messages):
    if not isinstance(messages, list):
        raise ValueError("messages must be an array")

    normalized = []
    for item in messages:
        if not isinstance(item, dict):
            raise ValueError("each message must be an object")
        role = str(item.get("role", "")).lower()
        if role not in {"user", "assistant", "system"}:
            raise ValueError("message role must be 'user', 'assistant', or 'system'")
        content = item.get("content")
        if content is None:
            raise ValueError("each message must include a content field")
        normalized.append({
            "role": role,
            "content": str(content),
        })
    return normalized


def _message_to_content(message):
    return types.Content(role=message["role"], parts=[types.Part(text=message["content"])])


def _generate_chat_title(messages):
    first_user = next(
        (m for m in messages if m.get("role") == "user" and str(m.get("content", "")).strip()),
        None,
    )
    if not first_user:
        return "New chat"

    text = str(first_user["content"]).strip()
    title = text[:48].strip()
    if len(text) > 48:
        title = title.rstrip() + "..."
    return title or "New chat"


def _serialize_chat_session(doc):
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", "New chat"),
        "messages": doc.get("messages", []),
        "createdAt": doc.get("createdAt"),
        "updatedAt": doc.get("updatedAt"),
    }


def _load_chat_session(user_id, chat_id):
    if not ObjectId.is_valid(chat_id):
        return None
    return _chat_sessions.find_one({"_id": ObjectId(chat_id), "userId": user_id})


def _save_chat_session(user_id, chat_id, messages, title=None):
    session = _load_chat_session(user_id, chat_id)
    if not session:
        return None

    update_data = {
        "messages": messages,
        "updatedAt": dt.datetime.utcnow().isoformat(),
    }
    if title is not None:
        update_data["title"] = title.strip() or session.get("title", "New chat")
    elif not session.get("title") or session.get("title") == "New chat":
        update_data["title"] = _generate_chat_title(messages)

    _chat_sessions.update_one(
        {"_id": session["_id"]},
        {"$set": update_data},
    )
    session.update(update_data)
    return _serialize_chat_session(session)


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
@auth_required
def ai_chat(claims):
    body      = request.get_json(silent=True) or {}
    messages  = body.get("messages")
    prompt    = (body.get("prompt") or "").strip()
    chat_id   = body.get("chat_id")
    user_id   = claims.get("userId")

    if not messages and not prompt:
        return jsonify({"error": True, "message": "Prompt or messages are required", "result": None}), 400

    if not GEMINI_API:
        return jsonify({"error": True, "message": "AI service not configured (missing GEMINI_API)", "result": None}), 503

    try:
        client     = genai.Client(api_key=GEMINI_API)
        model_name = GEMINI_MODEL or "gemini-2.0-flash"

        history_messages = []
        if messages is not None:
            history_messages = _normalize_chat_messages(messages)
        else:
            history_messages = [{"role": "user", "content": prompt}]

        history = [_message_to_content(message) for message in history_messages]

        max_iterations = 6
        for _ in range(max_iterations):
            response = client.models.generate_content(
                model=model_name,
                contents=history,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.1,
                ),
            )

            reply_text = response.text.strip()

            try:
                parsed = _extract_json(reply_text)
            except (json.JSONDecodeError, ValueError):
                return jsonify({
                    "error": False,
                    "result": {
                        "type":    "text",
                        "title":   "Answer",
                        "summary": reply_text,
                        "assistantText": reply_text,
                    },
                }), 200

            if "final" in parsed:
                final_payload = dict(parsed["final"])
                final_payload["assistantText"] = reply_text
                if chat_id:
                    final_payload["sessionId"] = chat_id

                if chat_id:
                    persisted_messages = history_messages + [{"role": "assistant", "content": reply_text}]
                    session = _save_chat_session(user_id, chat_id, persisted_messages)
                    if session:
                        final_payload["sessionId"] = session["id"]
                        final_payload["sessionTitle"] = session["title"]
                return jsonify({"error": False, "result": final_payload}), 200

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
                tool_result_text = f"Tool '{tool_name}' returned: {json.dumps(tool_result, indent=2)}"

                history.append(types.Content(role="assistant", parts=[types.Part(text=reply_text)]))
                history.append(types.Content(role="user", parts=[types.Part(text=tool_result_text)]))
                history_messages.append({"role": "assistant", "content": reply_text})
                history_messages.append({"role": "user", "content": tool_result_text})
                continue

            return jsonify({
                "error": False,
                "result": {
                    "type":    "text",
                    "title":   "Answer",
                    "summary": reply_text,
                    "assistantText": reply_text,
                },
            }), 200

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


@ai_bp.route("/ai/chat-sessions", methods=["GET"])
@auth_required
def list_chat_sessions(claims):
    user_id = claims.get("userId")
    sessions = list(_chat_sessions.find({"userId": user_id}, {"messages": 0}).sort("updatedAt", -1))
    payload = [_serialize_chat_session(session) for session in sessions]
    return make_response(False, "Chat sessions fetched successfully", payload)


@ai_bp.route("/ai/chat-sessions", methods=["POST"])
@auth_required
def create_chat_session(claims):
    body = request.get_json(silent=True) or {}
    title = str(body.get("title", "New chat") or "New chat").strip() or "New chat"
    user_id = claims.get("userId")
    now = dt.datetime.utcnow().isoformat()

    new_session = {
        "userId": user_id,
        "title": title,
        "messages": [],
        "createdAt": now,
        "updatedAt": now,
    }
    result = _chat_sessions.insert_one(new_session)
    new_session["_id"] = result.inserted_id
    return make_response(False, "Chat session created successfully", _serialize_chat_session(new_session), 201)


@ai_bp.route("/ai/chat-sessions/<chat_id>", methods=["GET"])
@auth_required
def get_chat_session(claims, chat_id):
    user_id = claims.get("userId")
    session = _load_chat_session(user_id, chat_id)
    if not session:
        return make_response(True, "Chat session not found", None, 404)
    return make_response(False, "Chat session loaded", _serialize_chat_session(session))


@ai_bp.route("/ai/chat-sessions/<chat_id>", methods=["PUT"])
@auth_required
def update_chat_session(claims, chat_id):
    body = request.get_json(silent=True) or {}
    user_id = claims.get("userId")
    session = _load_chat_session(user_id, chat_id)
    if not session:
        return make_response(True, "Chat session not found", None, 404)

    update_payload = {}
    if "title" in body:
        update_payload["title"] = str(body.get("title") or session.get("title", "New chat")).strip() or session.get("title", "New chat")
    if "messages" in body:
        update_payload["messages"] = _normalize_chat_messages(body.get("messages") or [])
    update_payload["updatedAt"] = dt.datetime.utcnow().isoformat()

    _chat_sessions.update_one({"_id": session["_id"]}, {"$set": update_payload})
    session.update(update_payload)
    return make_response(False, "Chat session updated successfully", _serialize_chat_session(session))


@ai_bp.route("/ai/chat-sessions/<chat_id>", methods=["DELETE"])
@auth_required
def delete_chat_session(claims, chat_id):
    user_id = claims.get("userId")
    session = _load_chat_session(user_id, chat_id)
    if not session:
        return make_response(True, "Chat session not found", None, 404)
    _chat_sessions.delete_one({"_id": session["_id"]})
    return make_response(False, "Chat session deleted successfully", None, 200)
