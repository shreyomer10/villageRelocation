import datetime as dt
import json

from flask import Blueprint, request, jsonify, abort
from google import genai

from config import GEMINI_API, GEMINI_MODEL
from utils.helpers import make_response
from utils.tokenAuth import auth_required

from .executor import run_conversation
from .sessions import (
    _chat_sessions,
    _generate_chat_title,
    _normalize_chat_messages,
    _serialize_chat_session,
    _load_chat_session,
    _create_chat_session,
    _save_chat_session,
)

ai_bp = Blueprint("ai", __name__)


def _extract_user_prompt(body: dict) -> str | None:
    """Get the new user message text from a /ai/chat body.

    Accepts either `{prompt: "..."}` or `{messages: [...]}` (legacy shape from
    the frontend). With `messages`, takes the last user-role entry.
    """
    prompt = (body.get("prompt") or "").strip()
    if prompt:
        return prompt
    messages = body.get("messages")
    if isinstance(messages, list):
        for msg in reversed(messages):
            if isinstance(msg, dict) and str(msg.get("role", "")).lower() == "user":
                text = str(msg.get("content", "")).strip()
                if text:
                    return text
    return None


@ai_bp.route("/ai/chat", methods=["POST"])
@auth_required
def ai_chat(claims):
    body = request.get_json(silent=True) or {}
    chat_id = body.get("chat_id")
    user_id = claims.get("userId")

    user_prompt = _extract_user_prompt(body)
    if not user_prompt:
        return jsonify({
            "error": True,
            "message": "Prompt or messages are required",
            "result": None,
        }), 400

    if not GEMINI_API:
        return jsonify({
            "error": True,
            "message": "AI service not configured (missing GEMINI_API)",
            "result": None,
        }), 503

    try:
        client = genai.Client(api_key=GEMINI_API)
        model_name = GEMINI_MODEL or "gemini-2.0-flash"

        if not chat_id:
            title = _generate_chat_title([{"role": "user", "content": user_prompt}])
            new_session = _create_chat_session(user_id, title)
            chat_id = str(new_session["_id"])
            persisted_history = []
        else:
            session = _load_chat_session(user_id, chat_id)
            if not session:
                return jsonify({
                    "error": True,
                    "message": "Chat session not found",
                    "result": None,
                }), 404
            persisted_history = session.get("messages", [])

        # Strip trace fields before sending to Gemini — the model sees only
        # the clean role/content turns. Assistant turns are persisted as a
        # JSON-encoded final_payload (so the frontend can re-render
        # tables/charts); for the model we fall back to the human-readable
        # summary so it doesn't see raw JSON in its context.
        def _content_for_model(msg):
            content = msg.get("content")
            if msg.get("role") == "assistant" and isinstance(content, str):
                stripped = content.strip()
                if stripped.startswith("{"):
                    try:
                        parsed = json.loads(stripped)
                    except ValueError:
                        return content
                    if isinstance(parsed, dict):
                        return (
                            parsed.get("summary")
                            or parsed.get("title")
                            or content
                        )
            return content

        clean_history = [
            {"role": m["role"], "content": _content_for_model(m)}
            for m in persisted_history
            if isinstance(m, dict) and "role" in m and "content" in m
        ]

        final_payload, trace = run_conversation(
            client=client,
            model=model_name,
            history_messages=clean_history,
            user_prompt=user_prompt,
        )

        summary = (
            final_payload.get("summary")
            or final_payload.get("title")
            or "(no summary)"
        )
        # Persist the full final_payload (table/chart data + summary) as a
        # JSON string so the frontend can re-hydrate and re-render the
        # table/chart on session reload. The clean text history sent to
        # Gemini still strips this back to plain summary in `clean_history`.
        try:
            persisted_assistant_content = json.dumps(final_payload)
        except (TypeError, ValueError):
            persisted_assistant_content = summary

        full_messages = persisted_history + [
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": persisted_assistant_content, "trace": trace},
        ]

        session = _save_chat_session(user_id, chat_id, full_messages)
        if not session:
            return jsonify({
                "error": True,
                "message": "Chat session not found",
                "result": None,
            }), 404

        payload = dict(final_payload)
        payload["assistantText"] = summary
        payload["sessionId"] = session["id"]
        payload["sessionTitle"] = session["title"]
        payload["trace"] = trace
        return jsonify({"error": False, "result": payload}), 200

    except Exception as exc:
        return jsonify({
            "error": True,
            "message": f"AI service error: {exc}",
            "result": None,
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
    new_session = _create_chat_session(user_id, title)
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
